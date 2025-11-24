// KSL 통합 워크스페이스
class KSLWorkspace {
    constructor() {
        // State
        this.currentTab = 'collect';
        this.model = new SignLanguageModel();

        // Data Collection
        this.collectedData = [];
        this.selectedGesture = null;
        this.sessionCount = 0;
        this.isRecording = false;
        this.collectCamera = null;
        this.collectHands = null;
        this.showSkeletonCollect = true;
        this.autoSaveEnabled = false;
        this.collectFPS = 0;
        this.lastFrameTime = Date.now();
        this.targetCount = parseInt(localStorage.getItem('ksl_target_count') || '800');
        this.completedGestures = {};
        this.lastNotificationTime = {};

        // Training
        this.isTraining = false;
        this.trainingModel = null;

        // Translation
        this.translateCamera = null;
        this.translateHands = null;
        this.isTranslating = false;
        this.recognitionHistory = [];
        this.showSkeletonTranslate = true;
        this.translateFPS = 0;
        this.translateCount = 0;
        this.confidenceSum = 0;
        this.selectedModelName = null;
        this.lastRecognized = null;
        this.lastRecognizedTime = 0;

        // Competition mode
        this.isCompetitionMode = false;
        this.competitionModels = [];

        this.initialize();
    }

    async initialize() {
        console.log('KSL Workspace 초기화 중...');

        // Tab navigation
        this.setupTabNavigation();

        // Load data from server
        await this.loadDataFromServer();

        // Initialize UI
        this.initializeCollectionUI();
        this.initializeTrainingUI();
        this.initializeTranslationUI();
        this.initializeModelManagementUI();

        console.log('KSL Workspace 초기화 완료!');
    }

    async loadDataFromServer() {
        try {
            const response = await fetch('/api/collector/data');
            const data = await response.json();

            if (data.dataset && Array.isArray(data.dataset)) {
                // Merge server data with local data
                const localData = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');

                // Use server data as the source of truth if it has more data
                if (data.dataset.length >= localData.length) {
                    localStorage.setItem('ksl_dataset', JSON.stringify(data.dataset));
                    console.log(`서버에서 ${data.dataset.length}개의 데이터를 로드했습니다.`);
                } else {
                    console.log(`로컬 데이터 사용 (로컬: ${localData.length}, 서버: ${data.dataset.length})`);
                }
            }
        } catch (error) {
            console.error('서버 데이터 로드 실패:', error);
        }
    }

    setupTabNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tab}`);
        });

        // Update progress flow
        document.getElementById('flowCollect').classList.toggle('active', tab === 'collect');
        document.getElementById('flowTrain').classList.toggle('active', tab === 'train');
        document.getElementById('flowTranslate').classList.toggle('active', tab === 'translate');

        this.currentTab = tab;

        // Stop cameras when switching tabs
        if (tab !== 'collect' && this.collectCamera) {
            this.stopCollectionCamera();
        }
        if (tab !== 'translate' && this.translateCamera) {
            this.stopTranslationCamera();
        }
    }

    // ============================================
    // DATA COLLECTION
    // ============================================

    initializeCollectionUI() {
        this.populateGestureGrid();

        // Event listeners
        document.getElementById('startCollectBtn').addEventListener('click', () => this.startCollectionCamera());
        document.getElementById('stopCollectBtn').addEventListener('click', () => this.stopCollectionCamera());
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('saveDataBtn').addEventListener('click', () => this.saveCollectedData());
        document.getElementById('resetDataBtn').addEventListener('click', () => this.resetCollectedData());

        // Skeleton toggle
        document.getElementById('skeletonToggleCollect').addEventListener('change', (e) => {
            this.showSkeletonCollect = e.target.checked;
        });

        // Auto-save toggle
        document.getElementById('autoSaveToggle').addEventListener('change', (e) => {
            this.autoSaveEnabled = e.target.checked;
        });

        // Search
        document.getElementById('gestureSearch').addEventListener('input', (e) => {
            this.filterGestures(e.target.value);
        });

        // Target edit button
        document.getElementById('editTargetBtn').addEventListener('click', () => this.openTargetModal());
        document.getElementById('cancelTargetBtn').addEventListener('click', () => this.closeTargetModal());
        document.getElementById('confirmTargetBtn').addEventListener('click', () => this.updateTarget());

        // Close modal on outside click
        document.getElementById('targetModal').addEventListener('click', (e) => {
            if (e.target.id === 'targetModal') {
                this.closeTargetModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.currentTab === 'collect') {
                // Space: Toggle recording
                if (e.code === 'Space' && !e.target.matches('input, textarea')) {
                    e.preventDefault();
                    if (!document.getElementById('recordBtn').disabled) {
                        this.toggleRecording();
                    }
                }
                // Ctrl+S: Save data
                if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    this.saveCollectedData();
                }
            }
        });

        // Initialize target display
        document.getElementById('targetValue').textContent = this.targetCount;
        document.getElementById('targetInput').value = this.targetCount;

        this.updateCollectionStats();
        this.updateLiveProgress();
    }

    openTargetModal() {
        document.getElementById('targetModal').classList.add('show');
        document.getElementById('targetInput').value = this.targetCount;
        document.getElementById('targetInput').focus();
        document.getElementById('targetInput').select();
    }

    closeTargetModal() {
        document.getElementById('targetModal').classList.remove('show');
    }

    updateTarget() {
        const newTarget = parseInt(document.getElementById('targetInput').value);
        if (newTarget < 100 || newTarget > 5000) {
            alert('목표 개수는 100에서 5000 사이여야 합니다.');
            return;
        }

        this.targetCount = newTarget;
        localStorage.setItem('ksl_target_count', newTarget);
        document.getElementById('targetValue').textContent = newTarget;

        // Update all gesture cards and progress bar
        this.populateGestureGrid();
        this.updateLiveProgress();

        this.closeTargetModal();
    }

    populateGestureGrid() {
        const grid = document.getElementById('gestureGrid');
        const labels = this.model.labels.filter(l => l !== '대기');

        // Load existing data to get counts per gesture
        const dataset = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
        const countsByGesture = {};
        labels.forEach(label => countsByGesture[label] = 0);
        dataset.forEach(d => {
            if (countsByGesture[d.label] !== undefined) {
                countsByGesture[d.label]++;
            }
        });

        grid.innerHTML = '';

        labels.forEach(label => {
            const count = countsByGesture[label] || 0;
            const percentage = Math.min((count / this.targetCount) * 100, 100);
            const isCompleted = count >= this.targetCount;
            const wasCompleted = this.completedGestures && this.completedGestures[label];

            const card = document.createElement('div');
            let cardClasses = 'gesture-card';
            if (isCompleted) cardClasses += ' completed';
            if (this.selectedGesture === label) cardClasses += ' selected';
            card.className = cardClasses;
            card.dataset.gesture = label;
            card.innerHTML = `
                <div class="gesture-card-header">
                    <span class="gesture-name">${this.getGestureEmoji(label)} ${label}</span>
                    <span class="gesture-count">${count}/${this.targetCount}</span>
                </div>
                <div class="gesture-progress-bar">
                    <div class="gesture-progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="gesture-progress-text">${percentage.toFixed(1)}% 완료</div>
            `;
            card.addEventListener('click', () => this.selectGesture(label, card));
            grid.appendChild(card);

            // Show celebration if newly completed
            if (isCompleted && !wasCompleted) {
                this.showCompletionNotification(label);
            }
        });

        // Track completed gestures
        if (!this.completedGestures) {
            this.completedGestures = {};
        }
        labels.forEach(label => {
            const count = countsByGesture[label] || 0;
            this.completedGestures[label] = count >= this.targetCount;
        });

        this.allGestureCards = labels;
    }

    showCompletionNotification(label) {
        // Check if notification was already shown recently
        const now = Date.now();
        const lastShown = this.lastNotificationTime && this.lastNotificationTime[label];
        if (lastShown && now - lastShown < 10000) {
            return; // Don't show again within 10 seconds
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'completion-notification';
        notification.innerHTML = `
            <div class="notification-icon">🎉</div>
            <div class="notification-content">
                <div class="notification-title">목표 달성!</div>
                <div class="notification-message">"${label}" 동작 ${this.targetCount}개 수집 완료</div>
            </div>
        `;
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 4000);

        // Track notification time
        if (!this.lastNotificationTime) {
            this.lastNotificationTime = {};
        }
        this.lastNotificationTime[label] = now;
    }

    getGestureEmoji(label) {
        const map = {
            '안녕하세요': '👋', '감사합니다': '🙏', '좋아요': '👍', '싫어요': '👎',
            '확인': '👌', '평화': '✌️', '사랑해요': '🤟', '하나': '☝️',
            '둘': '✌️', '셋': '🤟', '넷': '🖖', '다섯': '🖐',
            '여섯': '🤙', '일곱': '🖖', '여덟': '🤘', '아홉': '👆',
            '열': '🙌', '주먹': '✊', '가리키기': '☝️', '멈춰': '✋',
            '와': '👈', '가': '👉', '예': '👍', '아니오': '👎',
            '물': '💧', '밥': '🍚', '도와주세요': '🆘', '미안합니다': '🙇',
            '잘가': '👋', '전화': '📱', '락': '🤘'
        };
        return map[label] || '✋';
    }

    selectGesture(label, card) {
        document.querySelectorAll('.gesture-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedGesture = label;
        document.getElementById('currentGesture').textContent = label;
        this.updateLiveProgress();
    }

    updateLiveProgress() {
        const progressText = document.getElementById('liveProgressText');
        const progressBarFill = document.getElementById('liveProgressBarFill');
        const progressRemaining = document.getElementById('progressRemaining');

        if (!this.selectedGesture) {
            document.getElementById('currentGestureProgress').textContent = '수집 진행률';
            document.getElementById('progressGestureName').textContent = '동작을 선택하세요';
            progressText.textContent = `0 / ${this.targetCount} (0%)`;
            progressText.classList.remove('complete');
            progressBarFill.style.width = '0%';
            progressBarFill.classList.remove('complete');
            progressRemaining.textContent = '-';
            progressRemaining.classList.remove('complete');
            return;
        }

        // Get current count for selected gesture
        const dataset = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
        const currentCount = dataset.filter(d => d.label === this.selectedGesture).length +
            this.collectedData.filter(d => d.label === this.selectedGesture).length;

        const percentage = Math.min((currentCount / this.targetCount) * 100, 100);
        const remaining = Math.max(this.targetCount - currentCount, 0);
        const isComplete = currentCount >= this.targetCount;

        // Update UI
        document.getElementById('currentGestureProgress').textContent = `"${this.selectedGesture}" 진행률`;
        document.getElementById('progressGestureName').textContent = `${this.getGestureEmoji(this.selectedGesture)} ${this.selectedGesture}`;
        progressText.textContent = `${currentCount} / ${this.targetCount} (${percentage.toFixed(1)}%)`;
        progressBarFill.style.width = `${percentage}%`;

        if (isComplete) {
            progressBarFill.classList.add('complete');
            progressText.classList.add('complete');
            progressRemaining.textContent = '✅ 목표 달성!';
            progressRemaining.classList.add('complete');
        } else {
            progressBarFill.classList.remove('complete');
            progressText.classList.remove('complete');
            progressRemaining.textContent = `${remaining}개 남음`;
            progressRemaining.classList.remove('complete');
        }
    }

    filterGestures(searchTerm) {
        const term = searchTerm.toLowerCase();
        const cards = document.querySelectorAll('.gesture-card');
        cards.forEach(card => {
            const gesture = card.dataset.gesture.toLowerCase();
            card.style.display = gesture.includes(term) ? 'block' : 'none';
        });
    }

    async startCollectionCamera() {
        const video = document.getElementById('videoCollect');
        const canvas = document.getElementById('canvasCollect');
        const ctx = canvas.getContext('2d');

        this.collectHands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.collectHands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        this.collectHands.onResults((results) => {
            // Calculate FPS
            const now = Date.now();
            this.collectFPS = Math.round(1000 / (now - this.lastFrameTime));
            this.lastFrameTime = now;
            document.getElementById('quickFPS').textContent = this.collectFPS;

            // Set canvas size to match video element dimensions
            canvas.width = video.videoWidth || video.clientWidth;
            canvas.height = video.videoHeight || video.clientHeight;

            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Hand detection indicator
            const handBadge = document.getElementById('handDetectionBadge');
            const handText = document.getElementById('handDetectionText');

            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                handBadge.classList.add('detected');
                handText.textContent = `${results.multiHandLandmarks.length}개 손 감지됨`;

                // Draw skeleton for each hand if enabled
                if (this.showSkeletonCollect) {
                    results.multiHandLandmarks.forEach(landmarks => {
                        if (typeof drawConnectors !== 'undefined' && typeof HAND_CONNECTIONS !== 'undefined') {
                            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
                        }
                        if (typeof drawLandmarks !== 'undefined') {
                            drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2, radius: 5 });
                        }
                    });
                }

                // Record only the first hand for training
                if (this.isRecording && this.selectedGesture) {
                    const landmarks = results.multiHandLandmarks[0];
                    const normalized = this.model.preprocessLandmarks(landmarks);
                    if (normalized) {
                        this.collectedData.push({
                            label: this.selectedGesture,
                            landmarks: normalized
                        });
                        this.sessionCount++;
                        this.updateCollectionStats();
                        this.updateLiveProgress();

                        // Auto-save every 100 samples
                        if (this.autoSaveEnabled && this.sessionCount % 100 === 0) {
                            this.autoSave();
                        }
                    }
                }
            } else {
                handBadge.classList.remove('detected');
                handText.textContent = '손 감지 대기';
            }
            ctx.restore();
        });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 }
            });
            video.srcObject = stream;

            this.collectCamera = new Camera(video, {
                onFrame: async () => {
                    await this.collectHands.send({ image: video });
                },
                width: 1280,
                height: 720
            });
            await this.collectCamera.start();

            document.getElementById('startCollectBtn').disabled = true;
            document.getElementById('stopCollectBtn').disabled = false;
            document.getElementById('recordBtn').disabled = false;
            document.getElementById('recordingStatus').textContent = '녹화 대기 중...';
        } catch (error) {
            alert('카메라 접근 실패: ' + error.message);
        }
    }

    stopCollectionCamera() {
        if (this.collectCamera) {
            this.collectCamera.stop();
        }
        const video = document.getElementById('videoCollect');
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }

        this.isRecording = false;
        document.getElementById('startCollectBtn').disabled = false;
        document.getElementById('stopCollectBtn').disabled = true;
        document.getElementById('recordBtn').disabled = true;
        document.getElementById('recordBtn').textContent = '녹화 시작';
        document.getElementById('recordBtn').classList.remove('btn-warning');
        document.getElementById('recordBtn').classList.add('btn-success');
        document.getElementById('recordingStatus').textContent = '카메라 정지됨';
    }

    toggleRecording() {
        if (!this.selectedGesture) {
            alert('먼저 수집할 동작을 선택해주세요!');
            return;
        }

        this.isRecording = !this.isRecording;
        const btn = document.getElementById('recordBtn');
        const indicator = document.getElementById('recordingIndicator');

        if (this.isRecording) {
            this.sessionCount = 0;
            btn.innerHTML = '⏹️ 녹화 중지';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-warning');
            indicator.classList.add('active');
            document.getElementById('gestureSearch').disabled = true;
            document.querySelectorAll('.gesture-card').forEach(c => c.style.pointerEvents = 'none');
            document.getElementById('recordingStatus').textContent = `"${this.selectedGesture}" 녹화 중...`;
        } else {
            btn.innerHTML = '🔴 녹화 시작';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-success');
            indicator.classList.remove('active');
            document.getElementById('gestureSearch').disabled = false;
            document.querySelectorAll('.gesture-card').forEach(c => c.style.pointerEvents = 'auto');
            document.getElementById('recordingStatus').textContent = '녹화 대기 중...';
        }
    }

    updateCollectionStats() {
        document.getElementById('sessionCount').textContent = this.sessionCount;
        document.getElementById('totalCount').textContent = this.collectedData.length;

        // Update quick stats
        document.getElementById('quickSessionCount').textContent = this.sessionCount;
        const dataset = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
        document.getElementById('quickTotalCount').textContent = dataset.length + this.collectedData.length;

        const progress = Math.min((this.collectedData.length / 1000) * 100, 100);
        document.getElementById('progressBar').style.width = progress + '%';

        // Update gesture grid every 10 samples to avoid performance issues
        if (this.sessionCount % 10 === 0) {
            this.populateGestureGrid();
        }

        // Update training tab
        this.updateTrainingDataInfo();
    }

    async autoSave() {
        const existingData = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
        const combined = [...existingData, ...this.collectedData];
        localStorage.setItem('ksl_dataset', JSON.stringify(combined));

        // Save to server
        try {
            await fetch('/api/collector/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dataset: combined })
            });
        } catch (error) {
            console.error('자동 저장 서버 동기화 실패:', error);
        }

        // Show notification
        const notification = document.getElementById('autoSaveNotification');
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);

        // Clear collected data after auto-save
        this.collectedData = [];
        this.updateCollectionStats();
        this.populateGestureGrid();
        this.updateLiveProgress();
    }

    async saveCollectedData() {
        if (this.collectedData.length === 0) {
            alert('수집된 데이터가 없습니다.');
            return;
        }

        try {
            // Save to localStorage
            const existingData = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
            const combined = [...existingData, ...this.collectedData];
            localStorage.setItem('ksl_dataset', JSON.stringify(combined));

            // Save to server
            const response = await fetch('/api/collector/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ dataset: combined })
            });

            const result = await response.json();

            if (result.success) {
                alert(`${this.collectedData.length}개의 데이터가 저장되었습니다!\n(로컬 + 서버)`);
                document.getElementById('recordingStatus').textContent = `${this.collectedData.length}개 데이터 저장 완료 (서버 동기화됨)`;
            } else {
                alert(`로컬 저장 성공, 서버 저장 실패: ${result.message}`);
                document.getElementById('recordingStatus').textContent = '로컬 저장만 완료됨 (서버 오류)';
            }

            // Mark collect step as completed
            document.getElementById('flowCollect').classList.add('completed');

            // Clear session data
            this.collectedData = [];
            this.sessionCount = 0;

            // Update UI
            this.updateCollectionStats();
            this.populateGestureGrid();
            this.updateLiveProgress();
            this.updateTrainingDataInfo();

        } catch (error) {
            console.error('저장 오류:', error);
            alert('데이터 저장 중 오류가 발생했습니다: ' + error.message);
        }
    }

    async resetCollectedData() {
        const choice = confirm('전체 데이터를 리셋하시겠습니까?\n\n확인: 전체 삭제\n취소: 특정 동작만 삭제');

        if (choice) {
            // 전체 리셋
            if (confirm('정말로 전체 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                localStorage.removeItem('ksl_dataset');
                this.collectedData = [];
                this.sessionCount = 0;
                this.updateCollectionStats();
                this.populateGestureGrid();
                this.updateLiveProgress();
                this.updateTrainingDataInfo();
                document.getElementById('recordingStatus').textContent = '전체 데이터가 리셋되었습니다.';
            }
        } else {
            // 특정 동작 리셋
            const gesture = prompt('삭제할 동작 이름을 입력하세요 (예: 안녕하세요):');
            if (gesture && gesture.trim()) {
                if (confirm(`"${gesture}" 동작의 데이터를 삭제하시겠습니까?`)) {
                    const dataset = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
                    const originalCount = dataset.length;
                    const filtered = dataset.filter(item => item.label !== gesture);
                    const removedCount = originalCount - filtered.length;

                    if (removedCount > 0) {
                        localStorage.setItem('ksl_dataset', JSON.stringify(filtered));

                        // 현재 세션 데이터에서도 제거
                        this.collectedData = this.collectedData.filter(item => item.label !== gesture);

                        this.updateCollectionStats();
                        this.populateGestureGrid();
                        this.updateLiveProgress();
                        this.updateTrainingDataInfo();
                        document.getElementById('recordingStatus').textContent =
                            `"${gesture}" 동작의 데이터 ${removedCount}개가 삭제되었습니다.`;
                    } else {
                        alert(`"${gesture}" 동작의 데이터가 없습니다.`);
                    }
                }
            }
        }
    }

    // ============================================
    // MODEL TRAINING
    // ============================================

    initializeTrainingUI() {
        document.getElementById('startTrainBtn').addEventListener('click', () => this.startTraining());
        document.getElementById('stopTrainBtn').addEventListener('click', () => this.stopTraining());

        // Preset selector
        document.getElementById('trainingPreset').addEventListener('change', (e) => {
            this.applyTrainingPreset(e.target.value);
        });

        // Sync sliders with number inputs
        this.setupSliderSync('epochs');
        this.setupSliderSync('batchSize');
        this.setupSliderSync('learningRate');

        document.getElementById('validationSplitSlider').addEventListener('input', (e) => {
            document.getElementById('validationSplitValue').textContent = (e.target.value * 100).toFixed(0) + '%';
        });

        this.updateTrainingDataInfo();
        this.initializeTrainingChart();
    }

    initializeTrainingChart() {
        const ctx = document.getElementById('trainingChart').getContext('2d');
        this.trainingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '학습 정확도',
                        data: [],
                        borderColor: '#4299e1',
                        backgroundColor: 'rgba(66, 153, 225, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: '검증 정확도',
                        data: [],
                        borderColor: '#48bb78',
                        backgroundColor: 'rgba(72, 187, 120, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: '학습 손실',
                        data: [],
                        borderColor: '#f56565',
                        backgroundColor: 'rgba(245, 101, 101, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    },
                    {
                        label: '검증 손실',
                        data: [],
                        borderColor: '#ed8936',
                        backgroundColor: 'rgba(237, 137, 54, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '정확도 (%)'
                        },
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: function (value) {
                                return value + '%';
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: '손실'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Epoch'
                        }
                    }
                }
            }
        });
    }

    updateTrainingChart(epoch, trainAcc, valAcc, trainLoss, valLoss) {
        this.trainingChart.data.labels.push(epoch);
        this.trainingChart.data.datasets[0].data.push(trainAcc * 100);
        this.trainingChart.data.datasets[1].data.push(valAcc * 100);
        this.trainingChart.data.datasets[2].data.push(trainLoss);
        this.trainingChart.data.datasets[3].data.push(valLoss);
        this.trainingChart.update('none'); // Update without animation for better performance
    }

    resetTrainingChart() {
        this.trainingChart.data.labels = [];
        this.trainingChart.data.datasets.forEach(dataset => {
            dataset.data = [];
        });
        this.trainingChart.update();
    }

    setupSliderSync(name) {
        const slider = document.getElementById(`${name}Slider`);
        const input = document.getElementById(`${name}Input`);

        if (slider && input) {
            slider.addEventListener('input', (e) => {
                input.value = e.target.value;
                document.getElementById('trainingPreset').value = 'custom';
            });

            input.addEventListener('input', (e) => {
                slider.value = e.target.value;
                document.getElementById('trainingPreset').value = 'custom';
            });
        }
    }

    applyTrainingPreset(preset) {
        const presets = {
            fast: {
                epochs: 20,
                batchSize: 64,
                learningRate: 0.003,
                validationSplit: 0.15
            },
            balanced: {
                epochs: 50,
                batchSize: 32,
                learningRate: 0.001,
                validationSplit: 0.2
            },
            accurate: {
                epochs: 100,
                batchSize: 16,
                learningRate: 0.0005,
                validationSplit: 0.25
            },
            professional: {
                epochs: 150,
                batchSize: 8,
                learningRate: 0.0003,
                validationSplit: 0.25
            }
        };

        if (preset !== 'custom' && presets[preset]) {
            const config = presets[preset];

            // Update epochs
            document.getElementById('epochsInput').value = config.epochs;
            document.getElementById('epochsSlider').value = config.epochs;

            // Update batch size
            document.getElementById('batchSizeInput').value = config.batchSize;
            document.getElementById('batchSizeSlider').value = config.batchSize;

            // Update learning rate
            document.getElementById('learningRateInput').value = config.learningRate;
            document.getElementById('learningRateSlider').value = config.learningRate;

            // Update validation split
            document.getElementById('validationSplitSlider').value = config.validationSplit;
            document.getElementById('validationSplitValue').textContent = (config.validationSplit * 100).toFixed(0) + '%';
        }
    }

    updateTrainingDataInfo() {
        const dataset = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
        const uniqueGestures = [...new Set(dataset.map(d => d.label))];

        document.getElementById('datasetSize').textContent = dataset.length;
        document.getElementById('gestureTypes').textContent = uniqueGestures.length;

        // 최소 2종류 이상의 제스처가 있어야 학습 가능
        const canTrain = uniqueGestures.length >= 2;
        const isOptimal = dataset.length >= 100 && uniqueGestures.length >= 5;

        if (!canTrain) {
            document.getElementById('trainingReady').textContent = '❌ 최소 2종류 필요';
            document.getElementById('trainingReady').className = 'text-muted';
            document.getElementById('startTrainBtn').disabled = true;
        } else if (isOptimal) {
            document.getElementById('trainingReady').textContent = '✅ 준비됨';
            document.getElementById('trainingReady').className = 'text-success';
            document.getElementById('startTrainBtn').disabled = false;
        } else {
            document.getElementById('trainingReady').textContent = '⚠️ 학습 가능 (권장: 100개 이상)';
            document.getElementById('trainingReady').className = 'text-warning';
            document.getElementById('trainingReady').style.color = '#ecc94b';
            document.getElementById('startTrainBtn').disabled = false;
        }
    }

    async startTraining() {
        const dataset = JSON.parse(localStorage.getItem('ksl_dataset') || '[]');
        const uniqueGestures = [...new Set(dataset.map(d => d.label))];

        // 최소 조건 확인
        if (uniqueGestures.length < 2) {
            alert('학습을 시작하려면 최소 2종류 이상의 제스처가 필요합니다.');
            return;
        }

        // 권장 조건 미달 시 경고
        if (dataset.length < 100) {
            const confirmed = confirm(
                `⚠️ 경고\n\n` +
                `현재 데이터셋: ${dataset.length}개\n` +
                `권장 데이터셋: 100개 이상\n\n` +
                `데이터가 적으면 학습 정확도가 낮을 수 있습니다.\n` +
                `그래도 학습을 진행하시겠습니까?`
            );
            if (!confirmed) return;
        }

        if (uniqueGestures.length < 5) {
            const confirmed = confirm(
                `⚠️ 경고\n\n` +
                `현재 제스처 종류: ${uniqueGestures.length}개\n` +
                `권장 제스처 종류: 5개 이상\n\n` +
                `제스처 종류가 적으면 모델의 범용성이 낮을 수 있습니다.\n` +
                `그래도 학습을 진행하시겠습니까?`
            );
            if (!confirmed) return;
        }

        this.isTraining = true;
        document.getElementById('startTrainBtn').disabled = true;
        document.getElementById('stopTrainBtn').disabled = false;
        document.getElementById('trainingProgress').style.display = 'block';
        document.getElementById('trainingChartSection').style.display = 'block';

        // Reset chart
        this.resetTrainingChart();

        this.addLog('학습 시작...', 'info');

        // Get training parameters
        const epochs = parseInt(document.getElementById('epochsInput').value);
        const batchSize = parseInt(document.getElementById('batchSizeInput').value);
        const learningRate = parseFloat(document.getElementById('learningRateInput').value);
        const validationSplit = parseFloat(document.getElementById('validationSplitSlider').value);

        try {
            // Prepare dataset
            this.addLog('데이터셋 준비 중...', 'info');
            const labelMap = {};
            this.model.labels.forEach((label, idx) => {
                labelMap[label] = idx;
            });

            const validData = dataset.filter(d => labelMap[d.label] !== undefined);
            tf.util.shuffle(validData);

            const inputs = validData.map(d => d.landmarks);
            const labels = validData.map(d => labelMap[d.label]);

            const xs = tf.tensor3d(inputs, [inputs.length, 21, 3]);
            const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), this.model.labels.length);

            this.addLog(`학습 데이터: ${inputs.length}개`, 'success');

            // Create model
            this.addLog('모델 생성 중...', 'info');
            this.trainingModel = await this.model.createModel();

            // Compile with custom learning rate
            this.trainingModel.compile({
                optimizer: tf.train.adam(learningRate),
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy']
            });

            this.addLog('학습 시작!', 'success');

            // Train
            await this.trainingModel.fit(xs, ys, {
                epochs: epochs,
                batchSize: batchSize,
                validationSplit: validationSplit,
                shuffle: true,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        if (!this.isTraining) return;

                        const progress = ((epoch + 1) / epochs) * 100;
                        document.getElementById('epochProgressBar').style.width = progress + '%';
                        document.getElementById('epochText').textContent = `${epoch + 1}/${epochs}`;

                        // TensorFlow.js sometimes uses 'accuracy' instead of 'acc'
                        const trainAcc = logs.acc || logs.accuracy || 0;
                        const valAcc = logs.val_acc || logs.val_accuracy || 0;

                        document.getElementById('trainAccuracy').textContent = (trainAcc * 100).toFixed(2) + '%';
                        document.getElementById('valAccuracy').textContent = (valAcc * 100).toFixed(2) + '%';
                        document.getElementById('trainLoss').textContent = logs.loss.toFixed(4);
                        document.getElementById('valLoss').textContent = logs.val_loss.toFixed(4);

                        // Update real-time chart
                        this.updateTrainingChart(epoch + 1, trainAcc, valAcc, logs.loss, logs.val_loss);

                        this.addLog(`Epoch ${epoch + 1}: 정확도 ${(valAcc * 100).toFixed(2)}%`, 'success');
                    }
                }
            });

            // Save model with custom name
            this.addLog('모델 저장 중...', 'info');

            // Get model name from input or generate timestamp-based name
            let modelName = document.getElementById('modelNameInput').value.trim();
            if (!modelName) {
                const now = new Date();
                modelName = `model_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
            }

            // Save to server using custom IO handler
            try {
                await this.saveModelToServer(this.trainingModel, modelName);
                this.addLog(`서버에 모델 저장 완료`, 'success');
            } catch (error) {
                this.addLog(`서버 저장 실패: ${error.message}`, 'error');
                throw error;
            }

            // Get final validation accuracy (stored as decimal 0-1)
            const valAccText = document.getElementById('valAccuracy').textContent;
            // Remove % sign and convert to decimal (e.g., "95.5%" -> 95.5)
            const finalAccuracy = parseFloat(valAccText.replace('%', ''));

            // Save metadata to server
            await fetch('/api/models/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: modelName,
                    info: {
                        timestamp: new Date().toISOString(),
                        accuracy: finalAccuracy,  // Already in 0-100 range
                        gestures: uniqueGestures.length,
                        samples: dataset.length,
                        epochs: epochs
                    }
                })
            });

            this.addLog(`✅ 학습 완료! 모델 "${modelName}"이(가) 저장되었습니다.`, 'success');

            // Mark train step as completed
            document.getElementById('flowTrain').classList.add('completed');

            // Reload model list for translation tab
            await this.loadModelList();

            xs.dispose();
            ys.dispose();

        } catch (error) {
            this.addLog('❌ 학습 실패: ' + error.message, 'error');
            console.error(error);
        } finally {
            this.isTraining = false;
            document.getElementById('startTrainBtn').disabled = false;
            document.getElementById('stopTrainBtn').disabled = true;
        }
    }

    stopTraining() {
        // TensorFlow.js doesn't support stopping training mid-way easily
        alert('학습을 중단하려면 페이지를 새로고침하세요.');
    }

    addLog(message, type = 'info') {
        const log = document.getElementById('trainingLog');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    async saveModelToServer(model, modelName) {
        // Custom IOHandler to save model to server
        const saveHandler = {
            save: async (modelArtifacts) => {
                // 1. Save model topology (JSON)
                // Create proper weightsManifest with correct paths and weight specs
                const weightsManifest = [{
                    paths: [`${modelName}.weights.bin`],
                    weights: modelArtifacts.weightSpecs || []
                }];

                const modelJSON = {
                    modelTopology: modelArtifacts.modelTopology,
                    format: modelArtifacts.format,
                    generatedBy: modelArtifacts.generatedBy,
                    convertedBy: modelArtifacts.convertedBy,
                    weightsManifest: weightsManifest
                };

                const topologyResponse = await fetch(`/api/models/upload?model_name=${encodeURIComponent(modelName)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(modelJSON)
                });

                if (!topologyResponse.ok) {
                    throw new Error('Failed to upload model topology');
                }

                // 2. Save weights (binary)
                if (modelArtifacts.weightData) {
                    const weightsResponse = await fetch(`/api/models/upload-weights?model_name=${encodeURIComponent(modelName)}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/octet-stream'
                        },
                        body: modelArtifacts.weightData
                    });

                    if (!weightsResponse.ok) {
                        throw new Error('Failed to upload model weights');
                    }
                }

                return {
                    modelArtifactsInfo: {
                        dateSaved: new Date().toISOString(),
                        modelTopologyType: 'JSON'
                    }
                };
            }
        };

        await model.save(saveHandler);
    }

    // ============================================
    // REAL-TIME TRANSLATION
    // ============================================

    async initializeTranslationUI() {
        document.getElementById('startTranslateBtn').addEventListener('click', () => this.startTranslation());
        document.getElementById('stopTranslateBtn').addEventListener('click', () => this.stopTranslation());
        document.getElementById('clearHistoryBtn').addEventListener('click', () => this.clearHistory());

        // Skeleton toggle
        document.getElementById('skeletonToggleTranslate').addEventListener('change', (e) => {
            this.showSkeletonTranslate = e.target.checked;
        });

        // Model selection
        document.getElementById('modelSelect').addEventListener('change', (e) => {
            this.selectedModelName = e.target.value;
            console.log('선택된 모델:', this.selectedModelName);
        });

        // Toggle detail view
        document.getElementById('toggleDetailBtn').addEventListener('click', () => {
            const detailView = document.getElementById('topPredictions');
            const btn = document.getElementById('toggleDetailBtn');

            if (detailView.style.display === 'none') {
                detailView.style.display = 'block';
                btn.textContent = '📊 간단히 보기';
            } else {
                detailView.style.display = 'none';
                btn.textContent = '📊 상세히 보기';
            }
        });

        // Toggle competition mode
        document.getElementById('toggleCompetitionBtn').addEventListener('click', () => {
            const competitionMode = document.getElementById('competitionMode');

            if (competitionMode.style.display === 'none') {
                competitionMode.style.display = 'block';
                this.populateCompetitionModels();
            } else {
                competitionMode.style.display = 'none';
            }
        });

        // Start competition
        document.getElementById('startCompetitionBtn').addEventListener('click', () => {
            this.startCompetition();
        });

        // Load available models
        await this.loadModelList();
    }

    populateCompetitionModels() {
        const container = document.getElementById('competitionModels');
        container.innerHTML = '';

        fetch('/api/models/list')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.models.length > 0) {
                    data.models.forEach(model => {
                        const item = document.createElement('div');
                        item.className = 'model-checkbox-item';
                        item.innerHTML = `
                            <input type="checkbox" id="comp_${model.name}" value="${model.name}">
                            <label class="model-checkbox-label" for="comp_${model.name}">
                                ${model.name} (${model.accuracy.toFixed(1)}%)
                            </label>
                        `;
                        container.appendChild(item);
                    });
                } else {
                    container.innerHTML = '<p class="text-muted">학습된 모델이 없습니다</p>';
                }
            });
    }

    async startCompetition() {
        // Get selected models
        const checkboxes = document.querySelectorAll('#competitionModels input[type="checkbox"]:checked');
        const selectedModels = Array.from(checkboxes).map(cb => cb.value);

        if (selectedModels.length < 2) {
            alert('최소 2개 이상의 모델을 선택해주세요!');
            return;
        }

        // Load all selected models
        this.competitionModels = [];
        const failedModels = [];

        for (const modelName of selectedModels) {
            try {
                console.log(`모델 로딩 시도: ${modelName}`);
                const modelURL = `/trained-model/${modelName}.json`;

                // Check if model file exists first
                const checkResponse = await fetch(modelURL, { method: 'HEAD' });
                if (!checkResponse.ok) {
                    console.error(`모델 파일이 존재하지 않습니다: ${modelName}`);
                    failedModels.push(modelName);
                    continue;
                }

                const model = await tf.loadLayersModel(modelURL);
                this.competitionModels.push({
                    name: modelName,
                    model: model
                });
                console.log(`✅ 모델 로드 성공: ${modelName}`);
            } catch (error) {
                console.error(`❌ 모델 로드 실패: ${modelName}`, error);
                failedModels.push(modelName);
            }
        }

        if (failedModels.length > 0) {
            alert(`다음 모델을 로드하지 못했습니다:\n${failedModels.join(', ')}\n\n먼저 모델 학습을 완료해주세요.`);
        }

        if (this.competitionModels.length < 2) {
            alert('최소 2개 이상의 모델이 필요합니다. 모델 학습을 먼저 진행해주세요.');
            this.isCompetitionMode = false;
            return;
        }

        this.isCompetitionMode = true;
        alert(`✅ ${this.competitionModels.length}개의 모델 경쟁이 시작됩니다!`);
    }

    async loadModelList() {
        try {
            const response = await fetch('/api/models/list');
            const data = await response.json();

            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = '';

            if (data.success && data.models.length > 0) {
                data.models.forEach((model, index) => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    const date = new Date(model.timestamp);
                    option.textContent = `${model.name} (정확도: ${model.accuracy.toFixed(1)}%, ${date.toLocaleDateString()})`;

                    modelSelect.appendChild(option);

                    // Select first model by default
                    if (index === 0) {
                        this.selectedModelName = model.name;
                    }
                });

                console.log(`${data.models.length}개의 모델을 찾았습니다.`);
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '학습된 모델이 없습니다';
                modelSelect.appendChild(option);
                this.selectedModelName = null;
            }
        } catch (error) {
            console.error('모델 목록 로드 실패:', error);
        }
    }

    async loadModel() {
        try {
            // Load model based on selection
            if (this.selectedModelName) {
                // Load from server
                const modelURL = `/trained-model/${this.selectedModelName}.json`;

                // Check if model exists
                const checkResponse = await fetch(modelURL, { method: 'HEAD' });
                if (!checkResponse.ok) {
                    throw new Error(`모델 파일이 서버에 존재하지 않습니다: ${this.selectedModelName}`);
                }

                console.log(`모델 로딩 중: ${this.selectedModelName}`);
                this.model.model = await tf.loadLayersModel(modelURL);
                this.model.isModelLoaded = true;
                console.log(`✅ 모델 "${this.selectedModelName}" 로드 완료! (서버에서)`);
            } else {
                throw new Error('선택된 모델이 없습니다');
            }
        } catch (error) {
            console.error('⚠️ 서버에서 모델을 로드할 수 없습니다:', error.message);
            this.model.isModelLoaded = false;
            throw error; // Re-throw to handle in calling function
        }
    }

    async startTranslation() {
        // Check if model is selected
        if (!this.selectedModelName) {
            alert('사용할 모델을 선택해주세요. 먼저 모델 학습을 진행해야 합니다.');
            return;
        }

        // Load selected model
        document.getElementById('statusText').textContent = '모델 로딩 중...';
        try {
            await this.loadModel();
        } catch (error) {
            console.error('모델 로드 오류:', error);
            alert('모델을 로드할 수 없습니다. 다른 모델을 선택하거나 새로 학습해주세요.\n\n오류: ' + error.message);
            document.getElementById('statusText').textContent = '대기 중';
            return;
        }

        if (!this.model.isModelLoaded) {
            alert('모델을 로드할 수 없습니다. 다른 모델을 선택하거나 새로 학습해주세요.');
            document.getElementById('statusText').textContent = '대기 중';
            return;
        }

        const video = document.getElementById('videoTranslate');
        const canvas = document.getElementById('canvasTranslate');
        const ctx = canvas.getContext('2d');

        this.translateHands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.translateHands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7
        });

        this.translateHands.onResults((results) => this.onTranslationResults(results, canvas, ctx));

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 1280, height: 720 }
            });
            video.srcObject = stream;

            this.translateCamera = new Camera(video, {
                onFrame: async () => {
                    await this.translateHands.send({ image: video });
                },
                width: 1280,
                height: 720
            });
            await this.translateCamera.start();

            this.isTranslating = true;
            document.getElementById('startTranslateBtn').disabled = true;
            document.getElementById('stopTranslateBtn').disabled = false;
            document.getElementById('modelSelect').disabled = true;
            document.getElementById('statusText').textContent = '인식 중';
            document.getElementById('statusBadge').querySelector('.status-indicator').style.backgroundColor = '#48bb78';
        } catch (error) {
            alert('카메라 접근 실패: ' + error.message);
            document.getElementById('statusText').textContent = '오류';
        }
    }

    stopTranslationCamera() {
        if (this.translateCamera) {
            this.translateCamera.stop();
        }
        const video = document.getElementById('videoTranslate');
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }

        this.isTranslating = false;
        document.getElementById('startTranslateBtn').disabled = false;
        document.getElementById('stopTranslateBtn').disabled = true;
        document.getElementById('modelSelect').disabled = false;
        document.getElementById('statusText').textContent = '정지됨';
        document.getElementById('statusBadge').querySelector('.status-indicator').style.backgroundColor = '#f56565';
    }

    stopTranslation() {
        this.stopTranslationCamera();
    }

    async onTranslationResults(results, canvas, ctx) {
        const video = document.getElementById('videoTranslate');

        // Calculate FPS
        const now = Date.now();
        this.translateFPS = Math.round(1000 / (now - this.lastFrameTime));
        this.lastFrameTime = now;
        document.getElementById('translateFPS').textContent = this.translateFPS;

        // Set canvas size to match video element dimensions
        canvas.width = video.videoWidth || video.clientWidth;
        canvas.height = video.videoHeight || video.clientHeight;

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Hand detection indicator
        const handBadge = document.getElementById('handDetectionBadgeTranslate');
        const handText = document.getElementById('handDetectionTextTranslate');

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            handBadge.classList.add('detected');
            handText.textContent = `${results.multiHandLandmarks.length}개 손 감지됨`;

            // Draw skeleton for each hand if enabled
            if (this.showSkeletonTranslate) {
                results.multiHandLandmarks.forEach(landmarks => {
                    if (typeof drawConnectors !== 'undefined' && typeof HAND_CONNECTIONS !== 'undefined') {
                        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
                    }
                    if (typeof drawLandmarks !== 'undefined') {
                        drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 2, radius: 5 });
                    }
                });
            }

            // Predict only with the first hand
            if (this.isTranslating) {
                const landmarks = results.multiHandLandmarks[0];

                // Competition mode: predict with multiple models
                if (this.isCompetitionMode && this.competitionModels && this.competitionModels.length > 0) {
                    await this.runCompetition(landmarks);
                }
                // Normal mode: predict with selected model
                else if (this.model.isModelLoaded) {
                    const result = await this.model.predict(landmarks);
                    if (result && result.topProbability > 0.7) {
                        this.displayTranslationResult(result);
                    }
                }
            }
        } else {
            handBadge.classList.remove('detected');
            handText.textContent = '손 감지 대기';
        }
        ctx.restore();
    }

    displayTranslationResult(result) {
        document.getElementById('resultText').textContent = result.topLabel;
        document.getElementById('confidenceValue').textContent = (result.topProbability * 100).toFixed(1) + '%';
        document.getElementById('confidenceFill').style.width = (result.topProbability * 100) + '%';
        document.getElementById('confidenceStatus').textContent = '인식됨!';

        // Display top 5 predictions
        if (result.predictions && result.predictions.length > 0) {
            this.updateTopPredictions(result.predictions);
        }

        // Update statistics
        this.translateCount++;
        this.confidenceSum += result.topProbability;
        document.getElementById('translateCount').textContent = this.translateCount;
        document.getElementById('translateConfidence').textContent =
            ((this.confidenceSum / this.translateCount) * 100).toFixed(1) + '%';

        // Add to history
        if (!this.lastRecognized || this.lastRecognized !== result.topLabel || Date.now() - this.lastRecognizedTime > 2000) {
            this.addToHistory(result.topLabel, result.topProbability);
            this.lastRecognized = result.topLabel;
            this.lastRecognizedTime = Date.now();
        }
    }

    updateTopPredictions(predictions) {
        const container = document.getElementById('topPredictionsList');
        container.innerHTML = '';

        // Show top 5 predictions
        predictions.slice(0, 5).forEach((pred, index) => {
            const rank = index + 1;
            const percentage = (pred.probability * 100).toFixed(1);

            const item = document.createElement('div');
            item.className = `prediction-item rank-${rank}`;
            // Set custom property for progress bar width
            item.style.setProperty('--percent', `${percentage}%`);

            item.innerHTML = `
                <span class="prediction-rank">${rank}</span>
                <span class="prediction-label">${this.getGestureEmoji(pred.label)} ${pred.label}</span>
                <span class="prediction-confidence">${percentage}%</span>
            `;

            container.appendChild(item);
        });
    }

    addToHistory(label, confidence) {
        const container = document.getElementById('historyContainer');

        // Remove empty message
        const empty = container.querySelector('.history-empty');
        if (empty) {
            empty.remove();
        }

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-gesture">${this.getGestureEmoji(label)} ${label}</div>
            <div class="history-meta">
                <span class="history-confidence">🎯 ${(confidence * 100).toFixed(1)}%</span>
                <span class="history-time">🕒 ${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        container.insertBefore(item, container.firstChild);

        // Keep only last 50 items
        while (container.children.length > 50) {
            container.removeChild(container.lastChild);
        }
    }

    clearHistory() {
        const container = document.getElementById('historyContainer');
        container.innerHTML = '<div class="history-empty">아직 인식 기록이 없습니다</div>';
    }

    async runCompetition(landmarks) {
        const resultsContainer = document.getElementById('competitionResults');
        const predictions = [];

        // Get predictions from all competition models
        for (const modelObj of this.competitionModels) {
            try {
                // Preprocess landmarks
                const normalized = this.model.preprocessLandmarks(landmarks);
                if (!normalized) continue;

                // Predict
                const inputTensor = tf.tensor3d([normalized], [1, 21, 3]);
                const predictionTensor = await modelObj.model.predict(inputTensor);
                const predictionData = await predictionTensor.data();

                // Clean up tensors
                inputTensor.dispose();
                predictionTensor.dispose();

                // Get top prediction
                const maxIndex = Array.from(predictionData).indexOf(Math.max(...predictionData));
                const maxProb = predictionData[maxIndex];

                predictions.push({
                    modelName: modelObj.name,
                    label: this.model.labels[maxIndex],
                    probability: maxProb
                });
            } catch (error) {
                console.error(`경쟁 예측 오류 (${modelObj.name}):`, error);
            }
        }

        // Sort by probability (highest first)
        predictions.sort((a, b) => b.probability - a.probability);

        // Display results
        resultsContainer.innerHTML = '';

        predictions.forEach((pred, index) => {
            const isWinner = index === 0;
            const item = document.createElement('div');
            item.className = `competition-result-item ${isWinner ? 'winner' : ''}`;
            item.innerHTML = `
                <span class="competition-model-name">${pred.modelName}</span>
                <span class="competition-prediction">${this.getGestureEmoji(pred.label)} ${pred.label}</span>
                <span class="competition-confidence">${(pred.probability * 100).toFixed(1)}%</span>
                ${isWinner ? '<span class="competition-winner-badge">🏆</span>' : ''}
            `;
            resultsContainer.appendChild(item);
        });
    }

    // ============================================
    // MODEL MANAGEMENT
    // ============================================

    initializeModelManagementUI() {
        // Load models when switching to management tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === 'manage') {
                btn.addEventListener('click', () => {
                    this.loadModelManagementList();
                });
            }
        });

        // Sort controls
        const sortSelect = document.getElementById('modelSortBy');
        const sortOrderBtn = document.getElementById('modelSortOrder');

        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.loadModelManagementList());
        }

        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                const currentOrder = sortOrderBtn.dataset.order || 'desc';
                const newOrder = currentOrder === 'desc' ? 'asc' : 'desc';
                sortOrderBtn.dataset.order = newOrder;
                sortOrderBtn.textContent = newOrder === 'desc' ? '⬇️' : '⬆️';
                this.loadModelManagementList();
            });
        }

        // Event delegation for model management buttons
        const container = document.getElementById('modelManagementList');
        if (container) {
            container.addEventListener('click', (e) => {
                const target = e.target;

                // Rename button
                if (target.classList.contains('btn-rename') || target.closest('.btn-rename')) {
                    const btn = target.closest('.btn-rename') || target;
                    const modelName = btn.dataset.modelName;
                    if (modelName) {
                        this.renameModel(modelName);
                    }
                }

                // Delete button
                if (target.classList.contains('btn-delete') || target.closest('.btn-delete')) {
                    const btn = target.closest('.btn-delete') || target;
                    const modelName = btn.dataset.modelName;
                    if (modelName) {
                        this.deleteModel(modelName);
                    }
                }
            });
        }
    }

    async loadModelManagementList() {
        try {
            const response = await fetch('/api/models/list');
            const data = await response.json();

            const container = document.getElementById('modelManagementList');
            container.innerHTML = '';

            if (data.success && data.models.length > 0) {
                let models = [...data.models];

                // Sorting logic
                const sortBy = document.getElementById('modelSortBy')?.value || 'date';
                const sortOrder = document.getElementById('modelSortOrder')?.dataset.order || 'desc';
                const multiplier = sortOrder === 'desc' ? -1 : 1;

                models.sort((a, b) => {
                    let valA, valB;
                    switch (sortBy) {
                        case 'accuracy':
                            valA = a.accuracy;
                            valB = b.accuracy;
                            break;
                        case 'samples':
                            valA = a.samples;
                            valB = b.samples;
                            break;
                        case 'gestures':
                            valA = parseInt(a.gestures);
                            valB = parseInt(b.gestures);
                            break;
                        case 'name':
                            valA = a.name.toLowerCase();
                            valB = b.name.toLowerCase();
                            break;
                        case 'date':
                        default:
                            valA = new Date(a.timestamp).getTime();
                            valB = new Date(b.timestamp).getTime();
                            break;
                    }

                    if (valA < valB) return -1 * multiplier;
                    if (valA > valB) return 1 * multiplier;
                    return 0;
                });

                models.forEach(model => {
                    const date = new Date(model.timestamp);
                    const item = document.createElement('div');
                    item.className = 'model-card';
                    item.innerHTML = `
                        <div class="model-card-header">
                            <div>
                                <div class="model-name">${model.name}</div>
                                <div class="model-date">${date.toLocaleDateString()} ${date.toLocaleTimeString()}</div>
                            </div>
                            <div class="model-accuracy-badge">
                                ${model.accuracy.toFixed(1)}%
                            </div>
                        </div>
                        <div class="model-stats-row">
                            <span class="model-stat-label">제스처</span>
                            <span class="model-stat-value">${model.gestures}개</span>
                        </div>
                        <div class="model-stats-row">
                            <span class="model-stat-label">샘플 수</span>
                            <span class="model-stat-value">${model.samples}</span>
                        </div>
                        <div class="model-stats-row">
                            <span class="model-stat-label">Epochs</span>
                            <span class="model-stat-value">${model.epochs}</span>
                        </div>
                        <div class="model-actions">
                            <button class="btn-icon-small btn-rename" data-model-name="${model.name}" title="이름 변경">
                                ✏️
                            </button>
                            <button class="btn-icon-small btn-delete" data-model-name="${model.name}" title="삭제">
                                🗑️
                            </button>
                        </div>
                    `;
                    container.appendChild(item);
                });

                // Update statistics
                const accuracies = data.models.map(m => m.accuracy);
                const bestAccuracy = Math.max(...accuracies);
                const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;

                document.getElementById('totalModelsCount').textContent = data.models.length;
                document.getElementById('bestModelAccuracy').textContent = bestAccuracy.toFixed(1) + '%';
                document.getElementById('averageAccuracy').textContent = avgAccuracy.toFixed(1) + '%';

            } else {
                container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 40px; grid-column: 1/-1;">저장된 모델이 없습니다. 먼저 모델을 학습해주세요.</p>';

                document.getElementById('totalModelsCount').textContent = '0';
                document.getElementById('bestModelAccuracy').textContent = '0%';
                document.getElementById('averageAccuracy').textContent = '0%';
            }
        } catch (error) {
            console.error('모델 목록 로드 실패:', error);
            const container = document.getElementById('modelManagementList');
            container.innerHTML = '<p class="text-muted" style="color: #f56565; grid-column: 1/-1;">모델 목록을 불러오는데 실패했습니다.</p>';
        }
    }

    async renameModel(oldName) {
        const newName = prompt(`모델 이름을 변경합니다.\n새로운 이름을 입력하세요:`, oldName);

        if (!newName || newName === oldName) {
            return;
        }

        try {
            const response = await fetch('/api/models/rename', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    old_name: oldName,
                    new_name: newName
                })
            });

            const result = await response.json();

            if (result.success) {
                alert(result.message);
                await this.loadModelManagementList();
                await this.loadModelList(); // Refresh translation tab model list
            } else {
                alert('이름 변경 실패: ' + result.message);
            }
        } catch (error) {
            console.error('이름 변경 오류:', error);
            alert('이름 변경 중 오류가 발생했습니다.');
        }
    }

    async deleteModel(modelName) {
        if (!confirm(`정말로 "${modelName}" 모델을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/models/delete/${encodeURIComponent(modelName)}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                alert(result.message);
                await this.loadModelManagementList();
                await this.loadModelList(); // Refresh translation tab model list
            } else {
                alert('삭제 실패: ' + result.message);
            }
        } catch (error) {
            console.error('삭제 오류:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    window.kslWorkspace = new KSLWorkspace();
});
