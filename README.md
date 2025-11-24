# HandCode V3.0 🤟

한국 수어(KSL) 실시간 통역 시스템

## 📋 프로젝트 소개

HandCode V3.0은 AI 기반 한국 수어 인식 및 실시간 통역 시스템입니다. MediaPipe와 TensorFlow.js를 활용하여 웹캠을 통해 수어를 인식하고 텍스트로 변환합니다.

## ✨ 주요 기능

### 1. 데이터 수집 📊
- 웹캠을 통한 실시간 손 동작 캡처
- 30개 이상의 수어 제스처 지원
- 자동 저장 및 진행률 추적
- 목표 데이터셋 수량 설정 가능

### 2. 모델 학습 🧠
- TensorFlow.js 기반 딥러닝 모델
- 실시간 학습 진행률 및 정확도 표시
- 다양한 학습 프리셋 제공
- 학습 중 실시간 그래프 표시

### 3. 실시간 통역 🤟
- 웹캠 기반 실시간 수어 인식
- 높은 정확도의 인식 결과
- 상위 5개 예측 결과 표시
- 인식 기록 및 신뢰도 표시

### 4. 모델 관리 ⚙️
- 여러 모델 저장 및 관리
- 모델 이름 변경 및 삭제
- 모델 성능 비교
- 모델 경쟁 모드

## 🚀 설치 및 실행

### 필요 사항
- Python 3.8 이상
- 웹캠
- 최신 웹 브라우저 (Chrome, Firefox, Edge 등)

### 설치

```bash
# 저장소 클론
git clone https://github.com/YOUR_USERNAME/HandCode-V3.0.git
cd HandCode-V3.0

# 필요한 패키지 설치
pip install flask flask-cors
```

### 실행

```bash
# Flask 서버 시작
python app_flask.py
```

브라우저에서 `http://localhost:5000` 접속

## 📁 프로젝트 구조

```
HandCode-V3.0/
├── app_flask.py          # Flask 백엔드 서버
├── requirements.txt      # Python 패키지 의존성
├── templates/            # HTML 템플릿
│   └── workspace.html   # 통합 워크스페이스
├── static/              # 정적 파일
│   ├── css/
│   │   └── styles.css   # 스타일시트
│   ├── js/
│   │   └── model.js     # AI 모델 클래스
│   └── workspace.js     # 워크스페이스 로직
├── trained-model/       # 학습된 모델 저장 (git에서 제외)
└── data/               # 학습 데이터 (git에서 제외)
```

## 🎯 지원되는 수어 제스처

- **인사**: 안녕하세요, 감사합니다, 미안합니다, 잘가
- **감정**: 좋아요, 싫어요, 사랑해요
- **동작**: 확인, 평화, 멈춰, 와, 가
- **숫자**: 하나~열 (1-10)
- **기타**: 주먹, 가리키기, 물, 밥, 도와주세요, 전화, 락

## 🛠️ 기술 스택

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **AI/ML**:
  - TensorFlow.js
  - MediaPipe Hands
- **기타**: Chart.js (데이터 시각화)

## 📊 모델 구조

- Input: 21 hand landmarks × 3 coordinates (x, y, z)
- Architecture:
  - Flatten Layer
  - Dense (256) + BatchNorm + Dropout
  - Dense (128) + BatchNorm + Dropout
  - Dense (64) + BatchNorm + Dropout
  - Dense (32) - Softmax
- Optimizer: Adam
- Loss: Categorical Crossentropy

## 🎮 사용 방법

### 1. 데이터 수집
1. "데이터 수집" 탭으로 이동
2. 수집할 제스처 선택
3. "카메라 시작" 클릭
4. "녹화 시작" 클릭하여 데이터 수집
5. 충분한 데이터 수집 후 저장

### 2. 모델 학습
1. "모델 학습" 탭으로 이동
2. 학습 파라미터 설정 (또는 프리셋 선택)
3. 모델 이름 입력 (선택사항)
4. "학습 시작" 클릭
5. 학습 완료 대기

### 3. 실시간 통역
1. "실시간 통역" 탭으로 이동
2. 사용할 모델 선택
3. "통역 시작" 클릭
4. 수어 제스처 수행

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 👨‍💻 개발자

HandCode Team

## 🙏 감사의 말

- MediaPipe - 손 랜드마크 감지
- TensorFlow.js - 브라우저 기반 머신러닝
- Flask - 웹 프레임워크

---

**Note**: 이 프로젝트는 교육 및 연구 목적으로 개발되었습니다.
